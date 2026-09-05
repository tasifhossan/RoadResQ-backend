import { Router } from 'express';
import { AuthController } from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/register', AuthController.register);
