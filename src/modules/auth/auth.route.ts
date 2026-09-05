import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/sendResponse.js';

export const authRoutes = Router();

authRoutes.post('/register', AuthController.register);
authRoutes.post('/login', AuthController.login);

// Temporary protected route for testing authentication middleware
authRoutes.get('/me', authenticate, (req, res) => {
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Authenticated user profile retrieved',
    data: { user: req.user },
  });
});

