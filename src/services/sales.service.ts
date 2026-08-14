import { prisma } from '../config/prisma';

export class SalesService {
  static async getSalesKPIs() {
    const [
      totalOrders,
      paidOrdersCount,
      pendingOrdersCount,
      inTransitOrdersCount,
      deliveredOrdersCount,
      revenueAggregation,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { paymentStatus: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.order.count({ where: { status: 'OUT_FOR_DELIVERY' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
        where: { paymentStatus: 'COMPLETED' },
      }),
    ]);

    const totalRevenue = revenueAggregation._sum.totalAmount || 0;
    const averageOrderValue = revenueAggregation._avg.totalAmount || 0;

    return {
      totalOrders,
      paidOrdersCount,
      pendingOrdersCount,
      inTransitOrdersCount,
      deliveredOrdersCount,
      totalRevenue,
      averageOrderValue,
    };
  }

  static async getSalesAnalytics(options?: { startDate?: string; endDate?: string; days?: number }) {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (options?.startDate && options?.endDate) {
      start = new Date(options.startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      if (start > end) {
        const tmp = start;
        start = end;
        end = tmp;
      }
    } else {
      const numDays = options?.days && options.days > 0 ? options.days : 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (numDays - 1), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    const chartData: { name: string; date: string; revenue: number; orders: number }[] = [];
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.min(Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1), 90);

    for (let i = 0; i < diffDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayName = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      chartData.push({
        name: dayName,
        date: startOfDay.toISOString(),
        revenue: 0,
        orders: 0,
      });
    }

    const filteredOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        totalAmount: true,
        createdAt: true,
        paymentStatus: true,
      },
    });

    let totalChartRevenue = 0;
    let totalChartOrders = filteredOrders.length;

    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const dayName = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const bucket = chartData.find(b => b.name === dayName);
      if (bucket) {
        bucket.orders += 1;
        if (order.paymentStatus === 'COMPLETED') {
          bucket.revenue += Number(order.totalAmount || 0);
          totalChartRevenue += Number(order.totalAmount || 0);
        }
      }
    });

    const hasRealData = totalChartOrders > 0 || totalChartRevenue > 0;

    const recentOrders = await prisma.order.findMany({
      where: { paymentStatus: 'COMPLETED' },
      select: {
        totalAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const topSellingItems = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    let topProducts = (await Promise.all(
      topSellingItems.filter(item => item.productId).map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId as string },
          select: { id: true, title: true, sku: true, unitPrice: true, images: true, category: { select: { name: true } } },
        });

        if (!product) return null;

        const orderItems = await prisma.orderItem.findMany({
          where: { productId: item.productId as string, order: { paymentStatus: 'COMPLETED' } },
          select: { unitPrice: true, quantity: true, discountPercentage: true, gst: true },
        });

        const rev = orderItems.reduce((acc, oi) => {
          const disc = oi.discountPercentage || 0;
          const gst = oi.gst || 0;
          const priceAfterDisc = oi.unitPrice * (1 - disc / 100);
          const finalItemPrice = priceAfterDisc * (1 + gst / 100);
          return acc + finalItemPrice * oi.quantity;
        }, 0);

        const totalQty = orderItems.reduce((acc, oi) => acc + oi.quantity, 0);

        return {
          product,
          totalQuantitySold: totalQty || item._sum.quantity || 0,
          totalRevenue: rev || (product.unitPrice * (item._sum.quantity || 0)),
        };
      })
    )).filter((p): p is { product: any; totalQuantitySold: number; totalRevenue: number } => p !== null);

    // If no sales yet, fallback to top active catalog products from the database
    if (topProducts.length === 0) {
      const activeProducts = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, sku: true, unitPrice: true, images: true, category: { select: { name: true } } },
      });

      topProducts = activeProducts.map(prod => ({
        product: prod,
        totalQuantitySold: 0,
        totalRevenue: 0,
      }));
    }

    return {
      chartData,
      hasRealData,
      recentOrders,
      topProducts,
    };
  }

  static async exportSalesReport() {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        userProfile: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });

    const fields = ['Order Number', 'Date', 'Customer Name', 'Customer Email', 'Total Amount', 'Payment Status', 'Order Status'];
    const csvRows = [fields.join(',')];

    for (const order of orders) {
      const customerName = order.userProfile?.user ? `${order.userProfile.user.firstName} ${order.userProfile.user.lastName}` : order.shippingName;
      const row = [
        order.orderNumber,
        order.createdAt.toISOString(),
        `"${customerName.replace(/"/g, '""')}"`,
        order.userProfile?.user?.email || '',
        order.totalAmount.toFixed(2),
        order.paymentStatus,
        order.status,
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
