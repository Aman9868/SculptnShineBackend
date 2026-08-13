import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store files in the local 'uploads' directory
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    // Generate a unique filename using timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Create the multer instance with file filtering for images & videos
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos and images
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'));
    }
  },
});

// POST /api/upload
// Requires authentication
router.post('/', authenticate, upload.any(), (req: Request, res: Response) => {
  const uploadedFile = req.file || (req.files && (req.files as Express.Multer.File[])[0]);

  if (!uploadedFile) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${uploadedFile.filename}`;
  const isVideo = uploadedFile.mimetype.startsWith('video/');

  res.status(200).json({
    success: true,
    message: 'File uploaded successfully',
    url: fileUrl,
    type: isVideo ? 'video' : 'image',
    filename: uploadedFile.filename,
  });
});

export default router;
