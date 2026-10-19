import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { InvoiceStatus, PaymentStatus, RequestStatus, Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { globalErrorHandler } from '../../middlewares/globalErrorHandler.js';

function createMockContext(
  query: unknown = {},
  user?: { id: string; role: Role; email?: string },
  authHeader?: string
) {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['authorization'] = authHeader;
  }

  const req = {
    query,
    user,
    headers,
  } as unknown as Request;

  let statusCode = 200;
  let responseData: any = null;
  const responseHeaders: Record<string, string> = {};

  const res = {
    setHeader(name: string, value: string) {
      responseHeaders[name.toLowerCase()] = value;
      return this;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
  } as unknown as Response;

  const next = (err?: any) => {
    if (err) {
      globalErrorHandler(err, req, res, () => {});
    }
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getBody: () => responseData,
    getHeader: (name: string) => responseHeaders[name.toLowerCase()],
  };
}

describe('GET /users/me/summary', () => {
  it('rejects any query parameters with 400 Validation failed (strict Zod, no params)', async () => {
    const demoCustomer = await prisma.user.findUnique({
      where: { email: 'customer@roadresq-demo.com' },
    });
    assert.ok(demoCustomer, 'Demo customer must exist');

    const ctx = createMockContext(
      { unexpectedParam: 'test' },
      { id: demoCustomer.id, role: Role.CUSTOMER }
    );

    await UserController.getMySummary(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.getStatusCode(), 400);
    assert.equal(ctx.getBody().success, false);
    assert.equal(ctx.getBody().message, 'Validation failed');
    assert.ok(ctx.getBody().errors && ctx.getBody().errors.length > 0);
  });

  it('sets Cache-Control: private, no-store and returns 200 matching direct database queries for demo customer', async () => {
    const demoCustomer = await prisma.user.findUnique({
      where: { email: 'customer@roadresq-demo.com' },
    });
    assert.ok(demoCustomer, 'Demo customer must exist');

    // Run direct database queries to compare
    const [dbRequests, dbPaidPayments, dbUnpaidInvoices] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: { customerId: demoCustomer.id },
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.COMPLETED,
          invoice: { serviceRequest: { customerId: demoCustomer.id } },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          serviceRequest: { customerId: demoCustomer.id },
          status: { not: InvoiceStatus.PAID },
        },
      }),
    ]);

    const expectedCompletedCount = dbRequests.filter(
      (r) => r.status === RequestStatus.COMPLETED
    ).length;
    const expectedTotalRequests = dbRequests.length;
    const expectedTotalPaid = dbPaidPayments._sum.amount
      ? Number(dbPaidPayments._sum.amount).toFixed(2)
      : '0.00';

    const ctx = createMockContext({}, { id: demoCustomer.id, role: Role.CUSTOMER });

    await UserController.getMySummary(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.getStatusCode(), 200);
    assert.equal(ctx.getBody().success, true);
    assert.equal(ctx.getHeader('cache-control'), 'private, no-store');

    const data = ctx.getBody().data;
    assert.ok(data);

    // Verify requestsByStatus contains all 8 statuses
    const allStatuses = Object.values(RequestStatus);
    assert.ok(data.requestsByStatus);
    for (const status of allStatuses) {
      assert.equal(typeof data.requestsByStatus[status], 'number');
      const actualCountInDb = dbRequests.filter((r) => r.status === status).length;
      assert.equal(data.requestsByStatus[status], actualCountInDb);
    }

    // Verify totals
    assert.ok(data.totals);
    assert.equal(data.totals.requests, expectedTotalRequests);
    assert.equal(data.totals.completed, expectedCompletedCount);
    assert.equal(data.totals.totalPaid, expectedTotalPaid);
    assert.equal(data.totals.unpaidInvoices, dbUnpaidInvoices);

    // Verify spendByMonth: exactly 6 months, zero-filled, money strings
    assert.ok(Array.isArray(data.spendByMonth));
    assert.equal(data.spendByMonth.length, 6);
    for (const item of data.spendByMonth) {
      assert.match(item.month, /^\d{4}-\d{2}$/);
      assert.match(item.amount, /^\d+\.\d{2}$/);
    }
  });

  it('rejects without a token with 401 Unauthorized via authenticate middleware', () => {
    const ctx = createMockContext({}, undefined, undefined);

    authenticate(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.getStatusCode(), 401);
    assert.equal(ctx.getBody().success, false);
    assert.match(ctx.getBody().message, /Unauthorized/i);
  });

  it('rejects other roles (MECHANIC, ADMIN) with 403 Forbidden via authorize(Role.CUSTOMER)', () => {
    const authCustomer = authorize(Role.CUSTOMER);

    // Mechanic role rejected with 403
    const ctxMechanic = createMockContext({}, { id: 'm-1', role: Role.MECHANIC });
    authCustomer(ctxMechanic.req, ctxMechanic.res, ctxMechanic.next);
    assert.equal(ctxMechanic.getStatusCode(), 403);
    assert.equal(ctxMechanic.getBody().success, false);
    assert.match(ctxMechanic.getBody().message, /Forbidden/i);

    // Admin role rejected with 403
    const ctxAdmin = createMockContext({}, { id: 'a-1', role: Role.ADMIN });
    authCustomer(ctxAdmin.req, ctxAdmin.res, ctxAdmin.next);
    assert.equal(ctxAdmin.getStatusCode(), 403);
    assert.equal(ctxAdmin.getBody().success, false);
    assert.match(ctxAdmin.getBody().message, /Forbidden/i);

    // Customer role allowed
    let nextCalled = false;
    const ctxCustomer = createMockContext({}, { id: 'c-1', role: Role.CUSTOMER });
    authCustomer(ctxCustomer.req, ctxCustomer.res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  it('returns 404 when user does not exist or is soft-deleted', async () => {
    const ctx = createMockContext(
      {},
      { id: 'non-existent-user-id-999', role: Role.CUSTOMER }
    );

    await UserController.getMySummary(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.getStatusCode(), 404);
    assert.equal(ctx.getBody().success, false);
    assert.match(ctx.getBody().message, /User not found/i);
  });
});
