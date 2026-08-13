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

  static async getSalesAnalytics() {
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
        unitPrice: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    const topProducts = (await Promise.all(
      topSellingItems.filter(item => item.productId).map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId as string },
          select: { id: true, title: true, sku: true, unitPrice: true, images: true },
        });
        return {
          product,
          totalQuantitySold: item._sum.quantity || 0,
          totalRevenue: item._sum.unitPrice || 0,
        };
      })
    )).filter(p => p.product !== null);

    return {
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
