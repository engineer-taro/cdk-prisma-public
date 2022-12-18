import { Construct } from "constructs";

import {
  Duration,
  CfnOutput,
  RemovalPolicy,
  aws_iam as iam,
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
  aws_rds as rds,
  Token,
} from "aws-cdk-lib";
import * as fs from "fs";
import * as path from "path";

interface VpcRdsProps {
  envName: string;
  dbUserName: string;
  dbName: string;
}

export class VpcRds {
  public rdsProxyEndpoint: string;
  public rdsSecretArn: string;
  public iamGetSecretPolicy: iam.ManagedPolicy;
  public dbClientSg: ec2.SecurityGroup;
  public vpc: ec2.Vpc;

  constructor(scope: Construct, props: VpcRdsProps) {
    const envName = props.envName;
    // DB Name
    const DB_CLUSTER_NAME = `${envName}-db-cluster`;
    const DB_INSTANCE_NAME = `${envName}-db-cluster`;

    // Characters to exclude in passwords set for DB
    const EXCLUDE_CHARACTERS = ":/?#[]@!$&'()*+,;=%\"";

    // VPC
    const vpc = new ec2.Vpc(scope, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.100.0.0/16"),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 1,
      maxAzs: 2,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: "Isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Group
    // Security Group for DB Client
    const dbClientSg = new ec2.SecurityGroup(scope, "DbClientSg", {
      vpc,
      securityGroupName: `${envName}-db-client-sg`,
      description: "",
      allowAllOutbound: true,
    });

    // Security Group for Lambda Functions that rotate secret
    const rotateSecretsLambdaFunctionSg = new ec2.SecurityGroup(
      scope,
      "RotateSecretsLambdaFunctionSg",
      {
        vpc,
        securityGroupName: `${envName}-rotate-secrets-lambda-sg`,
        description: "",
        allowAllOutbound: true,
      }
    );

    // Security Group for RDS Proxy
    // Allow access from DB clients
    const rdsProxySg = new ec2.SecurityGroup(scope, "RdsProxySg", {
      vpc,
      securityGroupName: `${envName}-rds-proxy-sg`,
      description: "",
      allowAllOutbound: true,
    });
    rdsProxySg.addIngressRule(
      ec2.Peer.securityGroupId(dbClientSg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow RDS Proxy access from DB Client"
    );

    // Security Group for DB
    // Allow access from DB clients, Lambda Functions that rotate the secret and RDS Proxy
    const dbSg = new ec2.SecurityGroup(scope, "DbSg", {
      vpc,
      securityGroupName: `${envName}-db-sg`,
      description: "",
      allowAllOutbound: true,
    });
    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(rotateSecretsLambdaFunctionSg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow DB access from Lambda Functions that rotate Secrets"
    );
    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(dbClientSg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow DB access from DB Client"
    );
    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(rdsProxySg.securityGroupId),
      ec2.Port.tcp(5432),
      "Allow DB access from RDS Proxy"
    );

    // DB Admin User Secret
    const dbAdminSecret = new secretsmanager.Secret(scope, "DbAdminSecret", {
      secretName: `${DB_CLUSTER_NAME}/AdminLoginInfo`,
      generateSecretString: {
        excludeCharacters: EXCLUDE_CHARACTERS,
        generateStringKey: "password",
        passwordLength: 32,
        requireEachIncludedType: true,
        secretStringTemplate: `{"username": "${props.dbUserName}"}`,
      },
    });

    // DB Cluster Parameter Group
    const dbClusterParameterGroup = new rds.ParameterGroup(
      scope,
      "DbClusterParameterGroup",
      {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_13_4,
        }),
        description: "aurora-postgresql13",
        parameters: {
          "pgaudit.log": "all",
          "pgaudit.role": "rds_pgaudit",
          shared_preload_libraries: "pgaudit",
          timezone: "Asia/Tokyo",
        },
      }
    );

    // DB Parameter Group
    const dbParameterGroup = new rds.ParameterGroup(scope, "DbParameterGroup", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_4,
      }),
      description: "aurora-postgresql13",
    });

    // Subnet Group
    const subnetGroup = new rds.SubnetGroup(scope, "SubnetGroup", {
      description: "description",
      vpc,
      subnetGroupName: `${envName}-SubnetGroup`,
      vpcSubnets: vpc.selectSubnets({
        onePerAz: true,
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }),
    });

    // DB Cluster
    const dbCluster = new rds.DatabaseCluster(scope, "DbCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_4,
      }),
      instanceProps: {
        vpc,
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: true,
        deleteAutomatedBackups: false,
        enablePerformanceInsights: true,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE3,
          ec2.InstanceSize.MEDIUM
        ),
        parameterGroup: dbParameterGroup,
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
        publiclyAccessible: false,
        securityGroups: [dbSg],
      },
      backup: {
        retention: Duration.days(7),
        preferredWindow: "16:00-16:30",
      },
      cloudwatchLogsExports: ["postgresql"],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_YEAR,
      clusterIdentifier: DB_CLUSTER_NAME,
      copyTagsToSnapshot: true,
      credentials: rds.Credentials.fromSecret(dbAdminSecret),
      defaultDatabaseName: props.dbName,
      deletionProtection: false,
      iamAuthentication: false,
      instanceIdentifierBase: DB_INSTANCE_NAME,
      instances: 1,
      monitoringInterval: Duration.minutes(1),
      parameterGroup: dbClusterParameterGroup,
      preferredMaintenanceWindow: "Sat:17:00-Sat:17:30",
      storageEncrypted: true,
      subnetGroup,
    });

    // Rotate DB Admin user secret
    new secretsmanager.SecretRotation(scope, "DbAdminSecretRotation", {
      application:
        secretsmanager.SecretRotationApplication.POSTGRES_ROTATION_SINGLE_USER,
      secret: dbAdminSecret,
      target: dbCluster,
      vpc,
      automaticallyAfter: Duration.days(3),
      excludeCharacters: EXCLUDE_CHARACTERS,
      securityGroup: rotateSecretsLambdaFunctionSg,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });

    // RDS Proxy
    const rdsProxy = new rds.DatabaseProxy(scope, "RdsProxy", {
      proxyTarget: rds.ProxyTarget.fromCluster(dbCluster),
      secrets: [dbCluster.secret!],
      vpc,
      dbProxyName: `${envName}-db-proxy`,
      debugLogging: true,
      requireTLS: true,
      securityGroups: [rdsProxySg],
      vpcSubnets: vpc.selectSubnets({
        onePerAz: true,
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });

    // DB Client IAM Policy
    const getSecretValueIamPolicy = new iam.ManagedPolicy(
      scope,
      "GetSecretValueIamPolicy",
      {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [dbAdminSecret.secretArn],
            actions: ["secretsmanager:GetSecretValue"],
          }),
        ],
      }
    );

    // DB Client IAM Role
    const dbClientIamRole = new iam.Role(scope, "DbClientIamRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
        getSecretValueIamPolicy,
      ],
    });

    // User data for Amazon Linux 2
    const userDataParameter = fs.readFileSync(
      path.join(__dirname, "../user-data/init-bastion.sh"),
      "utf8"
    );
    const userDataAmazonLinux2 = ec2.UserData.forLinux({
      shebang: "#!/bin/bash",
    });
    userDataAmazonLinux2.addCommands(userDataParameter);

    // Bastion Keypair
    const cfnKeyPair = new ec2.CfnKeyPair(scope, "CfnKeyPair", {
      keyName: "test-key-pair",
    });
    cfnKeyPair.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // キーペア取得コマンドアウトプット
    new CfnOutput(scope, "GetSSHKeyCommand", {
      value: `aws ssm get-parameter --name /ec2/keypair/${cfnKeyPair.getAtt(
        "KeyPairId"
      )} --region ap-northeast-1 --with-decryption --query Parameter.Value --output text`,
    });

    // Bastion instance
    const bastionInstance = new ec2.Instance(scope, "DbClient", {
      instanceType: new ec2.InstanceType("t3.micro"),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpc,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
      role: dbClientIamRole,
      securityGroup: dbClientSg,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      userData: userDataAmazonLinux2,
      keyName: Token.asString(cfnKeyPair.ref),
    });

    const eip = new ec2.CfnEIP(scope, "EIP");
    // EC2 Instance <> EIP
    new ec2.CfnEIPAssociation(scope, "Ec2Association", {
      eip: eip.ref,
      instanceId: bastionInstance.instanceId,
    });

    this.vpc = vpc;
    this.rdsProxyEndpoint = rdsProxy.endpoint;
    this.rdsSecretArn = dbAdminSecret.secretArn;
    this.iamGetSecretPolicy = getSecretValueIamPolicy;
    this.dbClientSg = dbClientSg;
  }
}
