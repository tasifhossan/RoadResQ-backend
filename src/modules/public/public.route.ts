import { Router } from 'express';
import { PublicController } from './public.controller.js';

export const publicRoutes = Router();

// 1. GET /public/mechanics - Paginated list of public mechanics with search, filters, and facets
publicRoutes.get('/mechanics', PublicController.getMechanics);

// 2. GET /public/mechanics/:id - Detailed public mechanic profile, rating breakdown, reviews, and related mechanics
publicRoutes.get('/mechanics/:id', PublicController.getMechanicById);

// 3. GET /public/stats - Platform aggregated live KPIs
publicRoutes.get('/stats', PublicController.getStats);

// 4. GET /public/reviews - Latest customer reviews (comment length >= 20 chars)
publicRoutes.get('/reviews', PublicController.getReviews);
