import { Router } from 'express';
import { indexController } from '../controllers/index.controller';

const router = Router();

router.post('/load', indexController.loadData.bind(indexController));
router.get('/stats', indexController.getStats.bind(indexController));
router.delete('/clear', indexController.clearData.bind(indexController));

export default router;