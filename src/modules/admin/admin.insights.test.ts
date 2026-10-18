import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AdminController } from './admin.controller.js';
import { authorize } from '../../middlewares/rbac.middleware.js';
import { globalErrorHandler } from '../../middlewares/globalErrorHandler.js';

function createMockContext(query: unknown = {}, user?: { id: string; role: Role }) {
  const req = {
    query,
    user,
    headers: {},
  } as unknown as Request;

  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, string> = {};

  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
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
    getHeader: (name: string) => headers[name.toLowerCase()],
  };
}

describe('GET /admin/insights', () => {
  it('rejects any query parameters with 400 Validation failed', async () => {
    const { req, res, next, getStatusCode, getBody } = createMockContext({
      invalidParam: '123',
    });

    await AdminController.getInsights(req, res, next);

    assert.equal(getStatusCode(), 400);
    assert.equal(getBody().success, false);
    assert.equal(getBody().message, 'Validation failed');
    assert.ok(getBody().errors?.length > 0);
  });

  it('sets Cache-Control: private, no-store and returns 200 with complete metrics', async () => {
    const { req, res, next, getStatusCode, getBody, getHeader } = createMockContext({});

    await AdminController.getInsights(req, res, next);

    assert.equal(getStatusCode(), 200);
    assert.equal(getBody().success, true);
    assert.equal(getHeader('cache-control'), 'private, no-store');

    const data = getBody().data;
    assert.ok(data.generatedAt);
    assert.equal(typeof data.generatedAt, 'string');

    // requests
    assert.ok(data.requests);
    assert.equal(typeof data.requests.last14Days, 'number');
    assert.equal(typeof data.requests.previous14Days, 'number');
    assert.equal(typeof data.requests.changePct, 'number');
    assert.equal(typeof data.requests.completionRate, 'number');
    assert.equal(typeof data.requests.cancellationRate, 'number');

    // revenue
    assert.ok(data.revenue);
    assert.equal(typeof data.revenue.last14Days, 'string');
    assert.equal(typeof data.revenue.previous14Days, 'string');

    // rating
    assert.ok(data.rating);
    assert.ok(data.rating.last14Days === null || typeof data.rating.last14Days === 'number');
    assert.ok(data.rating.previous14Days === null || typeof data.rating.previous14Days === 'number');

    // dailyRequests & anomalies
    assert.ok(Array.isArray(data.dailyRequests));
    assert.equal(data.dailyRequests.length, 30);
    assert.ok(data.dailyRequests[0].date);
    assert.equal(typeof data.dailyRequests[0].count, 'number');

    assert.ok(Array.isArray(data.anomalies));

    // stuck
    assert.ok(data.stuck);
    assert.equal(typeof data.stuck.assignedOver24h.count, 'number');
    assert.equal(typeof data.stuck.openOver24h.count, 'number');
    assert.equal(typeof data.stuck.inProgressOver48h.count, 'number');

    // unpaidInvoices
    assert.ok(data.unpaidInvoices);
    assert.equal(typeof data.unpaidInvoices.count, 'number');
    assert.equal(typeof data.unpaidInvoices.totalAmount, 'string');

    // mechanics
    assert.ok(data.mechanics);
    assert.equal(typeof data.mechanics.available, 'number');
    assert.equal(typeof data.mechanics.busy, 'number');
    assert.equal(typeof data.mechanics.offline, 'number');
    assert.ok(Array.isArray(data.mechanics.topByCompleted30d));
    assert.ok(data.mechanics.topByCompleted30d.length <= 3);
    assert.ok(Array.isArray(data.mechanics.lowRated));

    // openByPriority
    assert.ok(data.openByPriority);
    assert.equal(typeof data.openByPriority.LOW, 'number');
    assert.equal(typeof data.openByPriority.NORMAL, 'number');
    assert.equal(typeof data.openByPriority.HIGH, 'number');
    assert.equal(typeof data.openByPriority.EMERGENCY, 'number');

    // lowStockItems
    assert.equal(typeof data.lowStockItems, 'number');
  });

  it('rejects CUSTOMER and MECHANIC roles with 403 Forbidden via authorize middleware', () => {
    const authAdmin = authorize(Role.ADMIN);

    // Customer
    const ctxCustomer = createMockContext({}, { id: 'cust-1', role: Role.CUSTOMER });
    authAdmin(ctxCustomer.req, ctxCustomer.res, ctxCustomer.next);
    assert.equal(ctxCustomer.getStatusCode(), 403);
    assert.equal(ctxCustomer.getBody().success, false);
    assert.match(ctxCustomer.getBody().message, /Forbidden/i);

    // Mechanic
    const ctxMechanic = createMockContext({}, { id: 'mech-1', role: Role.MECHANIC });
    authAdmin(ctxMechanic.req, ctxMechanic.res, ctxMechanic.next);
    assert.equal(ctxMechanic.getStatusCode(), 403);
    assert.equal(ctxMechanic.getBody().success, false);
    assert.match(ctxMechanic.getBody().message, /Forbidden/i);

    // Admin allowed
    let nextCalled = false;
    const ctxAdmin = createMockContext({}, { id: 'admin-1', role: Role.ADMIN });
    authAdmin(ctxAdmin.req, ctxAdmin.res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });
});
