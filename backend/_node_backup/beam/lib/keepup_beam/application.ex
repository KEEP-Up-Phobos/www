defmodule KeepupBeam.Application do
  @moduledoc false

  use Application

  def start(_type, _args) do
    port = Application.get_env(:keepup_beam, :port, 4004)

    dispatch = :cowboy_router.compile([
      {:_, [
        {"/socket", KeepupBeam.SocketHandler, []},
        {:_, :cowboy_static, {:priv_file, :keepup_beam, "index.html"}}
      ]}
    ])

    {:ok, _} = :cowboy.start_clear(:keepup_http, [{:port, port}], %{env: %{dispatch: dispatch}})

    children = [
      # Add worker children here if needed
    ]

    opts = [strategy: :one_for_one, name: KeepupBeam.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
