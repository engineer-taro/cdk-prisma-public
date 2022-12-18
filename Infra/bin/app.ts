#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PipelineStack } from "../lib/pipeline-stack";
const app = new cdk.App();

new PipelineStack(app, "DevBackendPipelineStack", {
  envName: "dev",
  repository: "<organization or username>/<repository name>", //TODO:環境にあわせて修正
  branch: "develop",
  connectionArn: "<codestarのARN>", //TODO: 環境にあわせて修正
});
