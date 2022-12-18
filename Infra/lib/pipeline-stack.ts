import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import * as iam from "aws-cdk-lib/aws-iam";
import { PipelineAppStage } from "./app-stage";
import { CommonProps } from "./settings/common-props";

interface PipelineProps extends CommonProps {
  repository: string;
  branch: string;
  connectionArn: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, "Pipeline", {
      pipelineName: "BackendPipeline",
      synth: new ShellStep("Synth", {
        input: CodePipelineSource.connection(props.repository, props.branch, {
          connectionArn: props.connectionArn,
        }),
        commands: [
          "cd Backend",
          "npm ci",
          "npx prisma generate",
          "cd ..",
          "cd Infra",
          "npm ci",
          "npm run build",
          "npx cdk synth",
        ],
        primaryOutputDirectory: "Infra/cdk.out",
      }),
      codeBuildDefaults: {
        rolePolicy: [
          new iam.PolicyStatement({
            actions: ["*"],
            resources: ["*"],
          }),
        ],
      },
    });

    pipeline.addStage(new PipelineAppStage(this, "backendStage", props));
  }
}
