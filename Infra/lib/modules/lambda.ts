import { Construct } from "constructs";
import { aws_ec2, aws_iam } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { LambdaFunction } from "../constructs/lambda-function";

interface LambdaProps {
  envName: string;
  pgHost: string;
  secretArn: string;
  dbClientSg: aws_ec2.SecurityGroup;
  iamGetSecretPolicy: aws_iam.ManagedPolicy;
  vpc: aws_ec2.Vpc;
}

export class Lambda {
  constructor(scope: Construct, props: LambdaProps) {
    const environmentValue = {
      PG_HOST: props.pgHost,
      SECRET_ID: props.secretArn,
      ENV_NAME: props.envName,
    };
    const secretAccessRole = new iam.Role(scope, "secretAccessRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaVPCAccessExecutionRole"
        ),
        props.iamGetSecretPolicy,
      ],
    });
    const lambdaProps = {
      environment: {
        ...environmentValue,
      },
      securityGroups: [props.dbClientSg],
      vpc: props.vpc,
      vpcSubnets: props.vpc.selectSubnets({
        subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      role: secretAccessRole,
    };

    const createTaskLambda = new LambdaFunction(
      scope,
      "CreateFunction",
      {
        ...lambdaProps,
      },
      {
        filePath: "create-task.ts",
      }
    );
  }
}
