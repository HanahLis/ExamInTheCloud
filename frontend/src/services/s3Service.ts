import { requestPresignedUrl } from './apiService';

/**
 * Luồng 4.4: Upload hình ảnh thật trực tiếp lên Amazon S3 qua Presigned URL
 * Frontend -> POST /questions/image-upload (AWS API Gateway + Lambda) -> S3 Presigned PUT URL -> Frontend Direct PUT -> S3 Bucket -> S3 Object URL
 */
const uploadViaPresignedUrl = async (
  file: File,
  prefix: 'questions' | 'faces'
): Promise<string> => {
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
};

export const uploadQuestionImage = (file: File) => uploadViaPresignedUrl(file, 'questions');
export const uploadFaceImage = (file: File) => uploadViaPresignedUrl(file, 'faces');
