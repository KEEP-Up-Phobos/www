import Config

config :keepup_beam,
  port: String.to_integer(System.get_env("KEEPUP_BEAM_PORT" || "4004")),
  ticket_secret: System.get_env("TICKET_SECRET" || "keepup_dev_secret_change_me")
