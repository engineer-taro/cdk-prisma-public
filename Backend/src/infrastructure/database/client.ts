import "dotenv/config";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from "@aws-sdk/client-secrets-manager";
import { PrismaClient } from "@prisma/client";

export async function getPrismaClient() {
  let dbClient: PrismaClient;
  if (process.env.ENV_NAME === "dev" || process.env.ENV_NAME === "prd") {
    const secretsManagerClient = new SecretsManagerClient({
      region: process.env.AWS_REGION!,
    });
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: process.env.SECRET_ID,
    });
    const getSecretValueCommandResponse = await secretsManagerClient.send(
      getSecretValueCommand
    );

    const secret = JSON.parse(getSecretValueCommandResponse.SecretString!);
    const dbUrl = `postgresql://${secret.username}:${secret.password}@${process.env.PG_HOST}:${secret.port}/${secret.dbname}?schema=cdk_prisma&connection_limit=1&socket_timeout=3`;
    dbClient = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  } else {
    dbClient = new PrismaClient();
  }
  return dbClient;
}
