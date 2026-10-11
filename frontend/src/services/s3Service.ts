import { requestPresignedUrl, isMockMode } from './apiService';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Luồng 4.4: Upload hình ảnh qua S3 Presigned URL (dùng chung cho cả Question và Face image)
 * Frontend -> POST /api/questions/image-upload (Lambda) -> presigned URL -> Frontend Direct PUT -> S3 -> S3 Object URL
 */
const uploadViaPresignedUrl = async (
  file: File,
  prefix: 'questions' | 'faces'
): Promise<string> => {
  if (isMockMode()) {
    return fileToBase64(file);
  }

  try {
    // 1. Gọi backend Lambda sinh S3 Presigned URL
    const { uploadUrl, fileUrl } = await requestPresignedUrl(
      file.name,
      file.type || 'image/jpeg',
      prefix
    );

    // 2. Direct HTTP PUT trực tiếp từ Frontend lên S3 (Native fetch hỗ trợ File stream hoàn hảo)
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
      body: file,
    });

    if (!res.ok) {
      throw new Error(`Upload ảnh lên S3 thất bại (${res.status}): ${res.statusText}`);
    }

    // 3. Trả về S3 Object URL để lưu metadata vào DynamoDB
    return fileUrl;
  } catch (err) {
    console.warn(`Upload S3 qua Presigned URL thất bại (${prefix}), fallback sang Base64:`, err);
    // Fallback an toàn sang Base64 nếu người dùng chưa có quyền Cognito token hoặc offline
    return fileToBase64(file);
  }
};

export const uploadQuestionImage = (file: File) => uploadViaPresignedUrl(file, 'questions');
export const uploadFaceImage = (file: File) => uploadViaPresignedUrl(file, 'faces');