import { StackProps } from "aws-cdk-lib";

export interface CommonProps extends StackProps {
  envName: string;
}
