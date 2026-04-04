import argparse
import logging
import os
from pathlib import Path
from warnings import warn

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks.llm.question_answering import SummaryQuestionAnswerer
from pathway.xpacks.llm.servers import QASummaryRestServer
from pydantic import BaseModel, ConfigDict, InstanceOf

# To use advanced features with Pathway Scale, get your free license key from
# https://pathway.com/features and paste it below.
# To use Pathway Community, comment out the line below.
pw.set_license_key("demo-license-key-with-telemetry")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()
DEFAULT_CONFIG_NAME = "app.yaml"


class App(BaseModel):
    question_answerer: InstanceOf[SummaryQuestionAnswerer]
    host: str = "0.0.0.0"
    port: int = 8000

    with_cache: bool | None = None  # deprecated
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING
    terminate_on_error: bool = False

    def run(self) -> None:
        server = QASummaryRestServer(  # noqa: F841
            self.host, self.port, self.question_answerer
        )

        if self.persistence_mode is None:
            if self.with_cache is True:
                warn(
                    "`with_cache` is deprecated. Please use `persistence_mode` instead.",
                    DeprecationWarning,
                )
                persistence_mode = pw.PersistenceMode.UDF_CACHING
            else:
                persistence_mode = None
        else:
            persistence_mode = self.persistence_mode

        if persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=persistence_mode,
            )
        else:
            persistence_config = None

        pw.run(
            persistence_config=persistence_config,
            terminate_on_error=self.terminate_on_error,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


def resolve_config_path(config_value: str) -> Path:
    script_dir = Path(__file__).parent
    config_path = Path(config_value)
    if not config_path.is_absolute():
        config_path = script_dir / config_path

    config_path = config_path.resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"Pathway config not found: {config_path}")

    return config_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Pathway assistant with a selected YAML config."
    )
    parser.add_argument(
        "--config",
        default=os.getenv("PATHWAY_CONFIG", DEFAULT_CONFIG_NAME),
        help="YAML config file to load (for example: app.yaml or ticket.yaml).",
    )
    parser.add_argument(
        "--host",
        default=os.getenv("PATHWAY_HOST"),
        help="Optional host override for the REST server.",
    )

    env_port = os.getenv("PATHWAY_PORT")
    parser.add_argument(
        "--port",
        type=int,
        default=int(env_port) if env_port else None,
        help="Optional port override for the REST server.",
    )

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    config_path = resolve_config_path(args.config)
    logging.info("Loading Pathway config from %s", config_path)

    with open(config_path, encoding="utf-8") as f:
        config = pw.load_yaml(f)

    if args.host:
        config["host"] = args.host
    if args.port is not None:
        config["port"] = args.port

    app = App(**config)
    app.run()
