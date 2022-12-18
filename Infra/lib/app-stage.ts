import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { AppStack } from "./app-stack";
import { CommonProps } from "./settings/common-props";

export class PipelineAppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: CommonProps) {
    super(scope, id, props);

    const appStack = new AppStack(this, "AppStack", props);
  }
}
