defmodule KeepupBeam.SocketHandler do
  @behaviour :cowboy_websocket
  require Logger

  # Called by :cowboy for normal HTTP requests; return upgrade to websocket
  def init(req, _state) do
    # Extract ticket from query params
    {query, _} = :cowboy_req.parse_qs(req)
    ticket = query |> Enum.find_value(fn {k, v} -> if k == "ticket", do: v, else: nil end)
    secret = System.get_env("TICKET_SECRET") || Application.get_env(:keepup_beam, :ticket_secret, "keepup_dev_secret_change_me")

    case KeepupBeam.AuthValidator.verify(ticket || "", secret) do
      {:ok, claims} ->
        Logger.info("[BEAM] Authenticated socket for user: #{inspect claims["sub"]}")
        req = :cowboy_req.set_resp_header("x-authenticated-user", to_string(claims["sub"] || "?"), req)
        {:cowboy_websocket, req, %{claims: claims}}
      {:error, reason} ->
        Logger.warn("[BEAM] Socket ticket verification failed: #{inspect reason}")
        body = Jason.encode!(%{ok: false, error: "authentication_failed", reason: reason})
        req = :cowboy_req.reply(401, %{"content-type" => "application/json"}, body, req)
        {:shutdown, req, %{}}
    end
  end

  # Called after websocket upgrade
  def websocket_init(state) do
    # Send welcome message with claims
    claims = Map.get(state, :claims, %{})
    msg = %{ok: true, message: "socket authenticated", user: claims}
    {:reply, {:text, Jason.encode!(msg)}, state}
  end

  def websocket_handle({:text, msg}, state) do
    # expect JSON messages
    case Jason.decode(msg) do
      {:ok, %{"type" => "ping"}} ->
        {:reply, {:text, Jason.encode!(%{type: "pong", ts: DateTime.utc_now() |> DateTime.to_iso8601()})}, state}
      {:ok, payload} ->
        {:reply, {:text, Jason.encode!(%{echo: payload})}, state}
      _ ->
        {:reply, {:text, Jason.encode!(%{error: "invalid_json"})}, state}
    end
  end

  def websocket_handle(_other, state), do: {:ok, state}

  def websocket_info(_info, state), do: {:ok, state}

  def terminate(_reason, _req, _state) do
    :ok
  end
end
