export interface IEnvVariables {
  env: string;
  dbUserName: string;
  dbName: string;
}

export class DevVariables implements IEnvVariables {
  env = "dev";
  dbUserName = `${this.env}Admin`;
  dbName = `${this.env}_cdk_prisma`;
}

export class PrdVariables implements IEnvVariables {
  env = "prd";
  dbUserName = `${this.env}Admin`;
  dbName = `${this.env}_cdk_prisma`;
}
