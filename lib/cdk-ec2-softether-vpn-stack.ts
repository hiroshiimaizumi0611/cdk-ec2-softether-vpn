import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkEc2SoftetherVpnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkEc2SoftetherVpnQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
