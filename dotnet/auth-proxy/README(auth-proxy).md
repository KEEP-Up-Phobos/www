# AuthProxy (.NET gRPC) — placeholder

This is a minimal gRPC Auth proxy that exposes `Auth.Validate(UserRequest)` and returns a `UserResponse`.

Run (requires .NET 8 SDK):
```bash
cd /var/www/KEEP-Up/dotnet/auth-proxy
dotnet run
```

The service listens on the default Kestrel ports. For development the following PHP client example can be used (requires grpc PHP extension):

```php
<?php
require 'vendor/autoload.php';
$client = new \Auth\AuthClient('localhost:5000', [
  'credentials' => Grpc\ChannelCredentials::createInsecure(),
]);
$req = new \Auth\UserRequest();
$req->setUserId('123');
$req->setToken('dev-token');
$resp = $client->Validate($req)->wait();
print_r($resp);
```

This server is a placeholder — integrate with Joomla DB or real authentication provider in `AuthService`.
