import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

const REGION = import.meta.env.VITE_AWS_REGION;
const BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME;
const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;

// Cấu hình S3 Client xác thực qua Cognito Identity Pool
const s3Client = new S3Client({
  region: REGION,
  credentials: fromCognitoIdentityPool({
    identityPoolId: IDENTITY_POOL_ID,
    clientConfig: { region: REGION },
    logins: {
      // Cung cấp id_token nếu đã đăng nhập
      [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]:
        localStorage.getItem('id_token') || ''
    }
  }),
});

export const uploadQuestionImage = async (file: File): Promise<string> => {
  const fileExtension = file.name.split('.').pop();
  const fileName = `questions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: file.type,
  });

  await s3Client.send(command);

  // Trả về public URL của ảnh trên S3
  return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;
};