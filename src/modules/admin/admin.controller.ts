import { Request, Response, NextFunction } from 'express';
import { AdminValidation } from './admin.validation.js';
import { AdminService } from './admin.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = AdminValidation.getUsersQuerySchema.safeParse(req.query);

    const page = parsedQuery.success ? parsedQuery.data.page : 1;
    const limit = parsedQuery.success ? parsedQuery.data.limit : 10;
    const role = parsedQuery.success ? parsedQuery.data.role : undefined;

    const result = await AdminService.getAllUsers(page, limit, role);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Users retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = AdminValidation.updateUserRoleSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const adminUserId = req.user!.id;
    const user = await AdminService.updateUserRole(
      req.params.id,
      parsedBody.data.role,
      adminUserId
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User role updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const deactivateUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminUserId = req.user!.id;
    const user = await AdminService.deactivateUser(req.params.id, adminUserId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User deactivated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const reactivateUser = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminUserId = req.user!.id;
    const user = await AdminService.reactivateUser(req.params.id, adminUserId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User reactivated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await AdminService.getDashboardStats();

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = AdminValidation.getAuditLogsQuerySchema.safeParse(req.query);

    const page = parsedQuery.success ? parsedQuery.data.page : 1;
    const limit = parsedQuery.success ? parsedQuery.data.limit : 10;
    const entityType = parsedQuery.success ? parsedQuery.data.entityType : undefined;
    const action = parsedQuery.success ? parsedQuery.data.action : undefined;

    const result = await AdminService.getAuditLogs(
      page,
      limit,
      entityType,
      action
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Audit logs retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const AdminController = {
  getAllUsers,
  updateUserRole,
  deactivateUser,
  reactivateUser,
  getDashboardStats,
  getAuditLogs,
};
