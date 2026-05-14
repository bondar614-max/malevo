import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stylesRouter from "./styles";
import statsRouter from "./stats";
import galleryRouter from "./gallery";
import reviewsRouter from "./reviews";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stylesRouter);
router.use(statsRouter);
router.use(galleryRouter);
router.use(reviewsRouter);
router.use(authRouter);

export default router;
