import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

const MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const REGION = import.meta.env.VITE_AWS_REGION;
const BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME;

const getClient = () =>
  new S3Client({
    region: REGION,
    credentials: fromCognitoIdentityPool({
      identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
      clientConfig: { region: REGION },
      logins: {
        [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]:
          localStorage.getItem('id_token') || '',
      },
    }),
  });

const uploadImage = async (file: File, prefix: string): Promise<string> => {
  if (MOCK) return URL.createObjectURL(file); // xem được ảnh ngay, không cần S3

  const ext = file.name.split('.').pop();
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  await getClient().send(
    new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: file, ContentType: file.type })
  );
  return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
};

export const uploadQuestionImage = (file: File) => uploadImage(file, 'questions');
export const uploadFaceImage = (file: File) => uploadImage(file, 'faces');