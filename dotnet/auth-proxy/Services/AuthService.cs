using System.Threading.Tasks;
using Grpc.Core;
using AuthProxy;

namespace AuthProxy.Services;

public class AuthService : Auth.AuthBase
{
    public override Task<UserResponse> Validate(UserRequest request, ServerCallContext context)
    {
        // Placeholder logic: accept token 'dev-token' as valid
        if (!string.IsNullOrEmpty(request.Token) && request.Token == "dev-token")
        {
            return Task.FromResult(new UserResponse { Valid = true, Username = "devuser", Email = "dev@local" });
        }
        return Task.FromResult(new UserResponse { Valid = false });
    }
}
