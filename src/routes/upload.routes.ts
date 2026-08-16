import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Create the multer instance with file filtering for images & videos
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'));
    }
  },
});

const handleUploadResponse = (req: Request, res: Response) => {
  const uploadedFile = req.file || (req.files && (req.files as Express.Multer.File[])[0]);

  if (!uploadedFile) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${uploadedFile.filename}`;
  const isVideo = uploadedFile.mimetype.startsWith('video/');

  return res.status(200).json({
    success: true,
    message: 'File uploaded successfully',
    url: fileUrl,
    data: {
      url: fileUrl,
      type: isVideo ? 'video' : 'image',
      filename: uploadedFile.filename,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size,
    },
    type: isVideo ? 'video' : 'image',
    filename: uploadedFile.filename,
  });
};

// Mount handlers for root and sub-routes (/, /image, /video, /file)
router.post('/', authenticate, upload.any(), handleUploadResponse);
router.post('/image', authenticate, upload.any(), handleUploadResponse);
router.post('/video', authenticate, upload.any(), handleUploadResponse);
router.post('/file', authenticate, upload.any(), handleUploadResponse);

export default router;
