import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'

export class CdkEc2SoftetherVpnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const vpc = new ec2.Vpc(this, 'VpnVpc', {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'Public',
        },
      ],
    })

    const sg = new ec2.SecurityGroup(this, 'VpnSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    })

    // 必要なポート
    const vpnPorts = [
      ec2.Port.udp(500),
      ec2.Port.udp(4500),
      ec2.Port.udp(1701),
      ec2.Port.tcp(443),
      ec2.Port.tcp(1194),
    ]

    for (const port of vpnPorts) {
      sg.addIngressRule(ec2.Peer.anyIpv4(), port, `Allow VPN port ${port}`)
    }

    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH')

    const role = new iam.Role(this, 'EC2SSMRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    })

    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonSSMManagedInstanceCore',
      ),
    )

    const userData = ec2.UserData.forLinux()

    userData.addCommands(
      // インストール準備
      'yum install -y gcc make wget tar',
      'cd /usr/local',
      'wget https://github.com/SoftEtherVPN/SoftEtherVPN_Stable/releases/download/v4.43-9799/softether-vpnserver-v4.43-9799-rtm-2023.01.16-linux-x64-64bit.tar.gz',
      'tar xzvf softether-vpnserver-*.tar.gz',
      'cd vpnserver',
      'yes 1 | make',
      'cd /usr/local/vpnserver',
      'chmod 600 *',
      'chmod +x vpnserver vpncmd',
      './vpnserver start',

      // IP転送有効化
      'echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf',
      'sysctl -p',

      // NAT設定
      'iptables -t nat -A POSTROUTING -s 192.168.30.0/24 -j MASQUERADE',

      // 自動起動設定
      'cat << EOF > /etc/systemd/system/vpnserver.service',
      '[Unit]',
      'Description=SoftEther VPN Server',
      'After=network.target',
      '',
      '[Service]',
      'Type=forking',
      'ExecStart=/usr/local/vpnserver/vpnserver start',
      'ExecStop=/usr/local/vpnserver/vpnserver stop',
      'ExecReload=/usr/local/vpnserver/vpnserver restart',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      'systemctl daemon-reexec',
      'systemctl daemon-reload',
      'systemctl enable vpnserver',
      'systemctl start vpnserver',

      // VPN 設定スクリプト作成
      'cat << EOF > /root/vpnsetup.vpncmd',
      'ServerPasswordSet password',
      'HubCreate VPNHUB /PASSWORD:hubpass',
      'Hub VPNHUB',
      'UserCreate vpnuser /GROUP:none /REALNAME:none /NOTE:none',
      'UserPasswordSet vpnuser /PASSWORD:vpnpassword',
      'IPsecEnable /L2TP:yes /L2TPRAW:no /ETHERIP:no /PSK:vpnsharedsecret /DEFAULTHUB:VPNHUB',
      'SstpEnable yes',
      'Hub VPNHUB',
      'SecureNatEnable',
      'Hub VPNHUB',
      'UserEnable vpnuser',
      'EOF',

      // 設定適用
      '/usr/local/vpnserver/vpncmd localhost /SERVER /IN:/root/vpnsetup.vpncmd',
    )

    const instance = new ec2.Instance(this, 'VpnInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      role,
      securityGroup: sg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      userData,
    })

    // Elastic IP を割り当て
    new ec2.CfnEIP(this, 'VpnEip', {
      instanceId: instance.instanceId,
    })
  }
}
