defmodule KeepupBeam.AuthValidator do
  @moduledoc """
  Simple JWT (HS256) validator for BEAM to verify tickets issued by `auth-proxy`.

  Usage:
    KeepupBeam.AuthValidator.verify(token, secret)
  Returns: {:ok, claims_map} | {:error, reason}
  """

  @spec verify(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def verify(token, secret) when is_binary(token) and is_binary(secret) do
    try do
      jwk = JOSE.JWK.from_oct(secret)
      {verified, jose_jwt} = JOSE.JWT.verify_strict(jwk, ["HS256"], token)
      case verified do
        true -> {:ok, jose_jwt.fields}
        _ -> {:error, "invalid_token"}
      end
    rescue
      e -> {:error, Exception.message(e)}
    end
  end
end
