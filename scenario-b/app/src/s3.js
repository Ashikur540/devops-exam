const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.S3_BUCKET;
const client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });

function presignPutUrl(key, expiresInSeconds = 300) {
  return getSignedUrl(client, new PutObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}

function presignGetUrl(key, expiresInSeconds = 60) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}

module.exports = { presignPutUrl, presignGetUrl, BUCKET };
