import { Construct } from "constructs";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { aws_lambda_nodejs, Duration } from "aws-cdk-lib";

interface ApiFunctionProps extends NodejsFunctionProps {}
interface ExtendsProps {
  filePath: string;
}

const backendPath = "../../../Backend";
const srcPath = `${backendPath}/src/handler`;

export class LambdaFunction extends NodejsFunction {
  constructor(
    scope: Construct,
    id: string,
    props: ApiFunctionProps,
    extendsProps: ExtendsProps
  ) {
    const defaultEnvironment = {
      NODE_OPTIONS: "--enable-source-maps",
    };
    const environment = {
      ...defaultEnvironment,
      ...props.environment,
    };
    props = {
      runtime: Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, srcPath, extendsProps.filePath),
      timeout: Duration.seconds(30),
      depsLockFilePath: path.join(__dirname, backendPath, "package-lock.json"),
      bundling: {
        forceDockerBundling: false,
        commandHooks: {
          beforeBundling: (i, o) => [`cd ${i} && npm ci`],
          afterBundling(i: string, o: string): string[] {
            return [
              // Prismaクエリエンジンを追加
              `cp ${i}/node_modules/.prisma/client/libquery_engine-rhel-* ${o}`,
              // Prismaスキーマ定義を追加
              `cp ${i}/prisma/schema.prisma ${o}`,
            ];
          },
          beforeInstall: (i, o) => [],
        },
      },
      role: props.role,
      environment: environment,
      ...props,
    };
    super(scope, id, props);
  }
}
