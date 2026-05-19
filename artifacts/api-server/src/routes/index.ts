import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stylesRouter from "./styles";
import statsRouter from "./stats";
import galleryRouter from "./gallery";
import reviewsRouter from "./reviews";
import authRouter from "./auth";
import adminRouter from "./admin";
import generateRouter from "./generate";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stylesRouter);
router.use(statsRouter);
router.use(galleryRouter);
router.use(reviewsRouter);
router.use(authRouter);
router.use(generateRouter);
router.use(uploadsRouter);
router.use(adminRouter);

export default router;
