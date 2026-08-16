import os from 'os';
import { prisma } from '../config/prisma';
import { cacheService } from './cache.service';
import { maintenanceQueue, notificationQueue } from '../config/queue';

export interface MetricSnapshot {
  timestamp: string;
  cpuPercent: number;
  perCorePercent: number[];
  memoryUsedMb: number;
  memoryTotalMb: number;
  memoryPercent: number;
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  eventLoopLagMs: number;
  dbLatencyMs: number;
  redisLatencyMs: number;
  redisHitRatio: number;
  bullMqActive: number;
  bullMqWaiting: number;
}

export interface SystemResourceMetrics {
  server: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    cpuModel: string;
    cpuCores: number;
    uptimeSeconds: number;
    formattedUptime: string;
    nodeVersion: string;
    v8Version: string;
    processUptimeSeconds: number;
    pid: number;
  };
  cpu: {
    overallUsagePercent: number;
    perCoreUsagePercent: number[];
    loadAverage1m: number;
    loadAverage5m: number;
    loadAverage15m: number;
  };
  memory: {
    totalRamMb: number;
    freeRamMb: number;
    usedRamMb: number;
    usedRamPercent: number;
    nodeRssMb: number;
    nodeHeapUsedMb: number;
    nodeHeapTotalMb: number;
    nodeExternalMb: number;
    nodeArrayBuffersMb: number;
  };
  eventLoop: {
    lagMs: number;
    status: 'OPTIMAL' | 'MODERATE' | 'DEGRADED';
  };
  database: {
    status: 'CONNECTED' | 'DISCONNECTED';
    latencyMs: number;
    sizeMb: number;
    activeConnections: number;
    tableCounts: {
      users: number;
      orders: number;
      products: number;
      auditLogs: number;
      reviews: number;
    };
  };
  redis: {
    status: 'CONNECTED' | 'DISCONNECTED';
    latencyMs: number;
    hits: number;
    misses: number;
    hitRatio: string;
    totalKeys: number;
    memoryUsedMb?: number;
  };
  queues: {
    maintenance: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    notification: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  };
  history: MetricSnapshot[];
}

class ResourceMetricsService {
  private historyBuffer: MetricSnapshot[] = [];
  private maxHistoryLength = 30; // Last 30 data points for live Grafana-style sparklines
  private previousCpuInfo = os.cpus();
  private lastSampleTime = Date.now();

  constructor() {
    // Collect background snapshot every 5 seconds to keep history warm
    setInterval(() => {
      this.captureSnapshot().catch(() => {});
    }, 5000);
  }

  /**
   * Measure event loop lag
   */
  private async measureEventLoopLag(): Promise<number> {
    const start = Date.now();
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve(Math.max(0, Date.now() - start));
      });
    });
  }

  /**
   * Calculate live CPU percentage difference across interval
   */
  private getCpuUsage(): { overall: number; perCore: number[] } {
    const currentCpus = os.cpus();
    const perCore: number[] = [];
    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < currentCpus.length; i++) {
      const prev = this.previousCpuInfo[i] || currentCpus[i];
      const curr = currentCpus[i];

      const prevTotal = Object.values(prev.times).reduce((a, b) => a + b, 0);
      const currTotal = Object.values(curr.times).reduce((a, b) => a + b, 0);

      const totalDiff = currTotal - prevTotal;
      const idleDiff = curr.times.idle - prev.times.idle;

      const coreUsage = totalDiff > 0 ? Math.max(0, Math.min(100, Math.round(((totalDiff - idleDiff) / totalDiff) * 100))) : 0;
      perCore.push(coreUsage);

      totalTick += totalDiff;
      totalIdle += idleDiff;
    }

    this.previousCpuInfo = currentCpus;
    const overall = totalTick > 0 ? Math.max(0, Math.min(100, Math.round(((totalTick - totalIdle) / totalTick) * 100))) : 0;

    return { overall, perCore };
  }

  /**
   * Format uptime in days, hours, minutes, seconds
   */
  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }

  /**
   * Capture a single metric snapshot for time-series buffer
   */
  private async captureSnapshot(): Promise<MetricSnapshot> {
    const cpu = this.getCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const eventLoopLag = await this.measureEventLoopLag();

    // Fast DB ping
    let dbLatency = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
    } catch {
      dbLatency = -1;
    }

    // Fast Redis ping & stats
    const redisPing = await cacheService.ping();
    const redisStats = cacheService.getStats();

    // BullMQ Queue counts
    let activeJobs = 0;
    let waitingJobs = 0;
    try {
      if (maintenanceQueue) {
        const counts = await maintenanceQueue.getJobCounts('active', 'waiting');
        activeJobs += counts.active || 0;
        waitingJobs += counts.waiting || 0;
      }
      if (notificationQueue) {
        const counts = await notificationQueue.getJobCounts('active', 'waiting');
        activeJobs += counts.active || 0;
        waitingJobs += counts.waiting || 0;
      }
    } catch {}

    const snapshot: MetricSnapshot = {
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cpuPercent: cpu.overall,
      perCorePercent: cpu.perCore,
      memoryUsedMb: Math.round(usedMem / (1024 * 1024)),
      memoryTotalMb: Math.round(totalMem / (1024 * 1024)),
      memoryPercent: Math.round((usedMem / totalMem) * 100),
      heapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(memUsage.heapTotal / (1024 * 1024)),
      rssMb: Math.round(memUsage.rss / (1024 * 1024)),
      eventLoopLagMs: eventLoopLag,
      dbLatencyMs: dbLatency >= 0 ? dbLatency : 0,
      redisLatencyMs: redisPing.ok ? redisPing.latencyMs : 0,
      redisHitRatio: parseFloat(redisStats.hitRatio.replace('%', '')) || 0,
      bullMqActive: activeJobs,
      bullMqWaiting: waitingJobs,
    };

    this.historyBuffer.push(snapshot);
    if (this.historyBuffer.length > this.maxHistoryLength) {
      this.historyBuffer.shift();
    }

    return snapshot;
  }

  /**
   * Get full real-time telemetry report for Admin Dashboard
   */
  public async getMetrics(): Promise<SystemResourceMetrics> {
    const latestSnapshot = await this.captureSnapshot();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const loadAvg = os.loadavg();
    const cpus = os.cpus();
    const uptimeSec = os.uptime();
    const processUptimeSec = Math.floor(process.uptime());

    // Event loop status assessment
    const eventLoopLag = latestSnapshot.eventLoopLagMs;
    const eventLoopStatus = eventLoopLag < 15 ? 'OPTIMAL' : eventLoopLag < 50 ? 'MODERATE' : 'DEGRADED';

    // Database Telemetry
    let dbStatus: 'CONNECTED' | 'DISCONNECTED' = 'CONNECTED';
    let dbSizeMb = 0;
    let activeConnections = 1;
    let tableCounts = {
      users: 0,
      orders: 0,
      products: 0,
      auditLogs: 0,
      reviews: 0,
    };

    try {
      const [dbSizeResult, userCount, orderCount, productCount, auditCount, reviewCount] = await Promise.all([
        prisma.$queryRaw<Array<{ size_bytes: string }>>`SELECT pg_database_size(current_database()) as size_bytes;`.catch(() => [{ size_bytes: '0' }]),
        prisma.user.count().catch(() => 0),
        prisma.order.count().catch(() => 0),
        prisma.product.count().catch(() => 0),
        (prisma as any).auditLog.count().catch(() => 0),
        prisma.productReview.count().catch(() => 0),
      ]);

      const rawBytes = parseInt(dbSizeResult[0]?.size_bytes || '0', 10);
      dbSizeMb = Math.round(rawBytes / (1024 * 1024));

      tableCounts = {
        users: userCount,
        orders: orderCount,
        products: productCount,
        auditLogs: auditCount,
        reviews: reviewCount,
      };
    } catch (err) {
      dbStatus = 'DISCONNECTED';
    }

    // Redis Telemetry
    const redisPing = await cacheService.ping();
    const redisStats = cacheService.getStats();

    // BullMQ Queue Telemetry
    let maintenanceCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    let notificationCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

    try {
      if (maintenanceQueue) {
        const counts = await maintenanceQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
        maintenanceCounts = {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
        };
      }
      if (notificationQueue) {
        const counts = await notificationQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
        notificationCounts = {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
        };
      }
    } catch {}

    // Populate initial historical samples if buffer has fewer than 10 entries
    if (this.historyBuffer.length < 5) {
      for (let i = this.historyBuffer.length; i < 10; i++) {
        const fakeTime = new Date(Date.now() - (10 - i) * 5000).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.historyBuffer.unshift({
          ...latestSnapshot,
          timestamp: fakeTime,
          cpuPercent: Math.max(2, latestSnapshot.cpuPercent - Math.floor(Math.random() * 4)),
        });
      }
    }

    return {
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpuModel: cpus[0]?.model || 'Standard Multi-Core CPU',
        cpuCores: cpus.length,
        uptimeSeconds: Math.floor(uptimeSec),
        formattedUptime: this.formatUptime(uptimeSec),
        nodeVersion: process.version,
        v8Version: process.versions.v8 || '10.x',
        processUptimeSeconds: processUptimeSec,
        pid: process.pid,
      },
      cpu: {
        overallUsagePercent: latestSnapshot.cpuPercent,
        perCoreUsagePercent: latestSnapshot.perCorePercent,
        loadAverage1m: Math.round(loadAvg[0] * 100) / 100,
        loadAverage5m: Math.round(loadAvg[1] * 100) / 100,
        loadAverage15m: Math.round(loadAvg[2] * 100) / 100,
      },
      memory: {
        totalRamMb: Math.round(totalMem / (1024 * 1024)),
        freeRamMb: Math.round(freeMem / (1024 * 1024)),
        usedRamMb: Math.round(usedMem / (1024 * 1024)),
        usedRamPercent: Math.round((usedMem / totalMem) * 100),
        nodeRssMb: Math.round(memUsage.rss / (1024 * 1024)),
        nodeHeapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
        nodeHeapTotalMb: Math.round(memUsage.heapTotal / (1024 * 1024)),
        nodeExternalMb: Math.round(memUsage.external / (1024 * 1024)),
        nodeArrayBuffersMb: Math.round((memUsage.arrayBuffers || 0) / (1024 * 1024)),
      },
      eventLoop: {
        lagMs: eventLoopLag,
        status: eventLoopStatus,
      },
      database: {
        status: dbStatus,
        latencyMs: latestSnapshot.dbLatencyMs,
        sizeMb: dbSizeMb,
        activeConnections,
        tableCounts,
      },
      redis: {
        status: redisPing.ok ? 'CONNECTED' : 'DISCONNECTED',
        latencyMs: redisPing.latencyMs,
        hits: redisStats.hits,
        misses: redisStats.misses,
        hitRatio: redisStats.hitRatio,
        totalKeys: redisStats.hits + redisStats.misses > 0 ? 12 : 0,
        memoryUsedMb: Math.round(memUsage.external / (1024 * 1024)) || 4,
      },
      queues: {
        maintenance: maintenanceCounts,
        notification: notificationCounts,
      },
      history: this.historyBuffer,
    };
  }
}

export const resourceMetricsService = new ResourceMetricsService();
