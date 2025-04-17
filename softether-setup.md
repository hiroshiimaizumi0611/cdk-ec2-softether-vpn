---

# SoftEther VPN Server セットアップ手順（AWS）

## 参考リンク

- [Zenn 記事](https://zenn.dev/oneframe/articles/setup_softether_aws#%E4%BB%AE%E6%83%B3%E3%83%8F%E3%83%96%E3%82%92%E4%BD%9C%E6%88%90)
- [Dropbox Paper メモ](https://paper.dropbox.com/doc/202544-37932-VPN--CjrMZinJn9yyzv6afT~Jc8UWAg-4pJniGu4uE9MkiwaVVBJ3)

---

## 1. パッケージの更新 & タイムゾーン設定

```bash
sudo yum update -y
sudo timedatectl set-timezone Asia/Tokyo
```

---

## 2. ビルド準備

```bash
sudo yum install -y gcc make
```

---

## 3. SoftEther VPN Server のダウンロードとビルド

```bash
cd /usr/local/src/
sudo curl -L -O https://jp.softether-download.com/files/softether/v4.42-9798-rtm-2023.06.30-tree/Linux/SoftEther_VPN_Server/64bit_-_ARM_64bit/softether-vpnserver-v4.42-9798-rtm-2023.06.30-linux-arm64-64bit.tar.gz
sudo tar zxvf softether-vpnserver-v4.42-9798-rtm-2023.06.30-linux-arm64-64bit.tar.gz
cd vpnserver/
make
```

---

## 4. 言語設定（日本語化）

```bash
sudo vi lang.config
```

- `en` → `ja` に変更して保存

---

## 5. 実行バイナリを配置

```bash
sudo mv vpnserver /usr/local/bin/
sudo mv vpncmd /usr/local/bin/
sudo mv hamcore.se2 /usr/local/bin/
```

---

## 6. 起動スクリプトの作成

以下の内容で `/opt/vpnserver.sh` を作成：

```bash
sudo vi /opt/vpnserver.sh
```

```sh
#!/bin/sh
# chkconfig: 2345 99 01
# description: SoftEther VPN Server

DAEMON=/usr/local/bin/vpnserver
LOCK=/var/lock/subsys/vpnserver

test -x $DAEMON || exit 0

case "$1" in
start)
$DAEMON start
touch $LOCK
;;
stop)
$DAEMON stop
rm -f $LOCK
;;
restart)
$DAEMON stop
sleep 3
$DAEMON start
;;
*)
echo "Usage: $0 {start|stop|restart}"
exit 1
esac

exit 0
```

```bash
sudo chmod +x /opt/vpnserver.sh
```

---

## 7. systemd サービス登録

```bash
sudo vi /etc/systemd/system/vpnserver.service
```

```ini
[Unit]
Description=SoftEther VPN Server
After=network.target

[Service]
ExecStart=/opt/vpnserver.sh start
ExecStop=/opt/vpnserver.sh stop
ExecReload=/opt/vpnserver.sh restart
Restart=always
Type=forking

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable vpnserver
sudo systemctl start vpnserver
```

---

## 8. VPN 設定

### 8.1 VPN サーバー接続

```bash
sudo vpncmd
```

- 「1」選択
- ホスト名は Enter（localhost）
- 仮想HUB名も Enter（省略）

### 8.2 仮想 HUB 作成

```bash
HubCreate <任意のHub名> /PASSWORD:<任意のパスワード>
Hub <上記で設定したHub名>
```

### 8.3 L2TP/IPsec の有効化

```bash
IPSecEnable
```

対話形式で以下を設定：

- Enable L2TP over IPsec Server Function: `yes`
- Enable Raw L2TP Server Function: `no`
- Enable EtherIP / L2TPv3: `no`
- Pre Shared Key: `<任意の共有シークレット>`
- Default Virtual HUB: `<任意の共有Hub名>`

### 8.4 ユーザー作成

```bash
UserCreate <任意のユーザー名> /GROUP:none /REALNAME:"VPN User" /NOTE:""
UserPasswordSet <上記で設定したユーザー名> /PASSWORD:<任意のパスワード>
```

### 8.5 SecureNAT（仮想DHCP）の有効化

```bash
SecureNatEnable
```

---

## 9. IP 転送の有効化

```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 10. iptables の NAT 設定（Masquerade）

```bash
sudo yum install -y iptables-services
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables-save | sudo tee /etc/sysconfig/iptables
sudo systemctl start iptables
sudo systemctl enable iptables
```

---

# ユーザー作成のみ行う場合
### 1. VPN サーバー接続

```bash
sudo vpncmd
```

### 2. 仮想 HUB 設定

```bash
Hub <設定したHub名>
```

### 3. ユーザー作成

```bash
UserCreate <任意のユーザー名> /GROUP:none /REALNAME:"VPN User" /NOTE:""
UserPasswordSet <上記で設定したユーザー名> /PASSWORD:<任意のパスワード>
```

