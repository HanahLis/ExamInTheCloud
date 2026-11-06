import { requestPresignedUrl } from './apiService';

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Luồng 4.4: Upload hình ảnh thật trực tiếp lên Amazon S3 qua Presigned URL
 * Frontend -> POST /questions/image-upload (AWS API Gateway + Lambda) -> S3 Presigned PUT URL -> Frontend Direct PUT -> S3 Bucket -> S3 Object URL
 * Tự động dự phòng: Nếu API Gateway trả về 401 hoặc offline, lưu an toàn dưới dạng Base64 Data URL.
 */
const uploadViaPresignedUrl = async (
  file: File,
  prefix: 'questions' | 'faces'
): Promise<string> => {
  try {
    // 1. Gọi backend Lambda sinh S3 Presigned URL chính thức
    const { uploadUrl, fileUrl } = await requestPresignedUrl(
      file.name,
      file.type || 'image/jpeg',
      prefix
    );

    // 2. Direct HTTP PUT trực tiếp từ trình duyệt lên S3
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

    // 3. Trả về link S3 Object thật lưu trên AWS (https://...s3.ap-southeast-1.amazonaws.com/...)
    return fileUrl;
  } catch (err) {
    console.warn(`[S3 Upload] Không thể tải ảnh trực tiếp lên S3 (${err}), tự động chuyển sang lưu Base64 Data URL an toàn.`);
    return await readFileAsDataUrl(file);
  }
};

export const uploadQuestionImage = (file: File) => uploadViaPresignedUrl(file, 'questions');
export const uploadFaceImage = (file: File) => uploadViaPresignedUrl(file, 'faces');
