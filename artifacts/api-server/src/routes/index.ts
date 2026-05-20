import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scanFoodRouter from "./scanFood";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scanFoodRouter);

export default router;
