import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Lambda } from "./modules/lambda";
import { VpcRds } from "./modules/vpc-rds";
import {
  IEnvVariables,
  PrdVariables,
  DevVariables,
} from "./settings/env-valiables";

interface AppStackProps extends cdk.StackProps {
  envName: string;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    let envVariables: IEnvVariables;
    if (props.envName === "prd") {
      envVariables = new PrdVariables();
    } else {
      envVariables = new DevVariables();
    }
    const vpcRds = new VpcRds(this, {
      envName: envVariables.env,
      dbUserName: envVariables.dbUserName,
      dbName: envVariables.dbName,
    });

    new Lambda(this, {
      envName: envVariables.env,
      vpc: vpcRds.vpc,
      pgHost: vpcRds.rdsProxyEndpoint,
      secretArn: vpcRds.rdsSecretArn,
      dbClientSg: vpcRds.dbClientSg,
      iamGetSecretPolicy: vpcRds.iamGetSecretPolicy,
    });
  }
}
