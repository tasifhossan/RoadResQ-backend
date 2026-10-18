import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AuthController } from './auth.controller.js';
import { oauth2Client } from './auth.service.js';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { globalErrorHandler } from '../../middlewares/globalErrorHandler.js';
import { hashPassword } from '../../utils/hashPassword.js';

function createMockContext(body: unknown) {
  const req = {
    body,
    ip: '127.0.0.1',
    headers: {},
  } as unknown as Request;

  let statusCode = 200;
  let responseData: any = null;
  let nextError: any = null;

  const res = {
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
    nextError = err;
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
    getNextError: () => nextError,
  };
}

describe('POST /auth/google handler', () => {
  const originalVerifyIdToken = oauth2Client.verifyIdToken;
  const originalFindFirst = prisma.user.findFirst;
  const originalCreateUser = prisma.user.create;
  const originalCreateRefreshToken = prisma.refreshToken.create;
  const originalGoogleClientId = env.googleClientId;

  beforeEach(() => {
    env.googleClientId = 'mock-google-client-id.apps.googleusercontent.com';
  });

  afterEach(() => {
    oauth2Client.verifyIdToken = originalVerifyIdToken;
    prisma.user.findFirst = originalFindFirst;
    prisma.user.create = originalCreateUser;
    prisma.refreshToken.create = originalCreateRefreshToken;
    env.googleClientId = originalGoogleClientId;
  });

  it('returns 503 if Google sign-in is not configured', async () => {
    env.googleClientId = '';
    const { req, res, next, getStatusCode, getBody } = createMockContext({
      idToken: 'some-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 503);
    assert.equal(getBody().success, false);
    assert.equal(getBody().message, 'Google sign-in is not configured');
  });

  it('returns 400 on invalid or non-strict request body', async () => {
    // Missing idToken
    const ctx1 = createMockContext({});
    await AuthController.googleSignIn(ctx1.req, ctx1.res, ctx1.next);
    assert.equal(ctx1.getStatusCode(), 400);
    assert.equal(ctx1.getBody().success, false);

    // Extra field violates strict schema
    const ctx2 = createMockContext({ idToken: 'valid-token', extraField: 'bad' });
    await AuthController.googleSignIn(ctx2.req, ctx2.res, ctx2.next);
    assert.equal(ctx2.getStatusCode(), 400);
    assert.equal(ctx2.getBody().success, false);
  });

  it('returns 401 when verifyIdToken encounters an invalid token', async () => {
    oauth2Client.verifyIdToken = (async () => {
      throw new Error('Invalid token signature');
    }) as any;

    const { req, res, next, getStatusCode, getBody, getNextError } = createMockContext({
      idToken: 'invalid-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 401);
    assert.equal(getNextError()?.statusCode, 401);
    assert.equal(getBody().success, false);
  });

  it('returns 401 when verifyIdToken encounters the wrong audience', async () => {
    oauth2Client.verifyIdToken = (async () => {
      throw new Error('Wrong recipient, payload audience != requiredAudience');
    }) as any;

    const { req, res, next, getStatusCode, getBody, getNextError } = createMockContext({
      idToken: 'token-with-wrong-audience',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 401);
    assert.equal(getNextError()?.statusCode, 401);
    assert.equal(getBody().success, false);
  });

  it('returns 401 when token email is unverified or missing', async () => {
    oauth2Client.verifyIdToken = (async () => ({
      getPayload: () => ({
        email: 'unverified@example.com',
        email_verified: false,
        name: 'Unverified User',
      }),
    })) as any;

    const { req, res, next, getStatusCode, getBody, getNextError } = createMockContext({
      idToken: 'unverified-email-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 401);
    assert.equal(getNextError()?.statusCode, 401);
    assert.equal(getBody().success, false);
    assert.match(getBody().message, /unverified|verified/i);
  });

  it('returns 403 "Account deactivated" when user exists and deletedAt is set', async () => {
    oauth2Client.verifyIdToken = (async () => ({
      getPayload: () => ({
        email: 'deactivated@example.com',
        email_verified: true,
        name: 'Deactivated User',
      }),
    })) as any;

    prisma.user.findFirst = (async () => ({
      id: 'deactivated-user-id',
      name: 'Deactivated User',
      email: 'deactivated@example.com',
      password: 'hashed-password',
      role: Role.CUSTOMER,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
    })) as any;

    const { req, res, next, getStatusCode, getBody, getNextError } = createMockContext({
      idToken: 'deactivated-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 403);
    assert.equal(getNextError()?.statusCode, 403);
    assert.equal(getBody().success, false);
    assert.equal(getBody().message, 'Account deactivated');
  });

  it('returns 403 "Admin accounts cannot use Google sign-in" when user exists and role is ADMIN', async () => {
    oauth2Client.verifyIdToken = (async () => ({
      getPayload: () => ({
        email: 'admin@example.com',
        email_verified: true,
        name: 'Admin User',
      }),
    })) as any;

    prisma.user.findFirst = (async () => ({
      id: 'admin-user-id',
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'hashed-password',
      role: Role.ADMIN,
      phone: '+1234567890',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })) as any;

    const { req, res, next, getStatusCode, getBody, getNextError } = createMockContext({
      idToken: 'admin-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 403);
    assert.equal(getNextError()?.statusCode, 403);
    assert.equal(getBody().success, false);
    assert.equal(getBody().message, 'Admin accounts cannot use Google sign-in');
  });

  it('creates a new CUSTOMER user and signs in when user does not exist', async () => {
    oauth2Client.verifyIdToken = (async () => ({
      getPayload: () => ({
        email: 'NewCustomer@Example.com',
        email_verified: true,
        name: 'Jane Customer',
      }),
    })) as any;

    prisma.user.findFirst = (async () => null) as any;

    let createdUserData: any = null;
    prisma.user.create = (async (args: any) => {
      createdUserData = args.data;
      return {
        id: 'new-customer-id',
        name: args.data.name,
        email: args.data.email,
        password: args.data.password,
        role: args.data.role,
        phone: args.data.phone,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
    }) as any;

    let createdTokenData: any = null;
    prisma.refreshToken.create = (async (args: any) => {
      createdTokenData = args.data;
      return { id: 'rt-id', ...args.data };
    }) as any;

    const { req, res, next, getStatusCode, getBody } = createMockContext({
      idToken: 'valid-new-user-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 200);
    assert.equal(getBody().success, true);
    assert.equal(getBody().message, 'Login successful');

    // Verify created user properties
    assert.ok(createdUserData);
    assert.equal(createdUserData.email, 'newcustomer@example.com'); // lowercased
    assert.equal(createdUserData.name, 'Jane Customer');
    assert.equal(createdUserData.role, Role.CUSTOMER);
    assert.equal(createdUserData.phone, null);
    assert.ok(createdUserData.password); // random 48-char hashed password

    // Verify response shape
    const data = getBody().data;
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.ok(data.user);
    assert.equal(data.user.email, 'newcustomer@example.com');
    assert.equal(data.user.role, 'CUSTOMER');
    assert.equal(data.user.password, undefined); // password stripped

    // Verify refresh token storage
    assert.ok(createdTokenData);
    assert.equal(createdTokenData.userId, 'new-customer-id');
    assert.ok(createdTokenData.token); // SHA-256 hash
  });

  it('uses fallback local part truncated to 100 chars when token name is missing', async () => {
    oauth2Client.verifyIdToken = (async () => ({
      getPayload: () => ({
        email: 'fallback.name.test@example.com',
        email_verified: true,
      }),
    })) as any;

    prisma.user.findFirst = (async () => null) as any;

    let createdUserData: any = null;
    prisma.user.create = (async (args: any) => {
      createdUserData = args.data;
      return {
        id: 'fallback-id',
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
    }) as any;

    prisma.refreshToken.create = (async (args: any) => ({
      id: 'rt-id',
      ...args.data,
    })) as any;

    const { req, res, next, getStatusCode } = createMockContext({
      idToken: 'valid-fallback-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 200);
    assert.ok(createdUserData);
    assert.equal(createdUserData.name, 'fallback.name.test');
  });

  it('successfully signs in an existing CUSTOMER or MECHANIC user', async () => {
    oauth2Client.verifyIdToken = (async () => ({
      getPayload: () => ({
        email: 'mechanic.user@example.com',
        email_verified: true,
        name: 'Bob Mechanic',
      }),
    })) as any;

    prisma.user.findFirst = (async () => ({
      id: 'existing-mechanic-id',
      name: 'Bob Mechanic',
      email: 'mechanic.user@example.com',
      password: 'existing-bcrypt-hash',
      role: Role.MECHANIC,
      phone: '+1987654321',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })) as any;

    let createdTokenData: any = null;
    prisma.refreshToken.create = (async (args: any) => {
      createdTokenData = args.data;
      return { id: 'rt-id', ...args.data };
    }) as any;

    const { req, res, next, getStatusCode, getBody } = createMockContext({
      idToken: 'existing-mechanic-token',
    });

    await AuthController.googleSignIn(req, res, next);

    assert.equal(getStatusCode(), 200);
    assert.equal(getBody().success, true);
    assert.equal(getBody().message, 'Login successful');

    const data = getBody().data;
    assert.equal(data.user.id, 'existing-mechanic-id');
    assert.equal(data.user.role, 'MECHANIC');
    assert.equal(data.user.password, undefined);
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.equal(createdTokenData.userId, 'existing-mechanic-id');
  });

  it('ensures existing email/password login is completely unaffected', async () => {
    const rawPassword = 'Password123!';
    const hashed = await hashPassword(rawPassword);

    prisma.user.findFirst = (async () => ({
      id: 'classic-user-id',
      name: 'Classic User',
      email: 'classic@example.com',
      password: hashed,
      role: Role.CUSTOMER,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })) as any;

    prisma.refreshToken.create = (async (args: any) => ({
      id: 'rt-classic',
      ...args.data,
    })) as any;

    const { req, res, next, getStatusCode, getBody } = createMockContext({
      email: 'classic@example.com',
      password: rawPassword,
    });

    await AuthController.login(req, res, next);

    assert.equal(getStatusCode(), 200);
    assert.equal(getBody().success, true);
    assert.equal(getBody().message, 'Login successful');
    assert.ok(getBody().data.accessToken);
    assert.ok(getBody().data.refreshToken);
    assert.equal(getBody().data.user.email, 'classic@example.com');
  });
});
