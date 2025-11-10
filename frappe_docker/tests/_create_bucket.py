import os

import boto3


def main() -> int:
    resource = boto3.resource(
        service_name="s3",
        endpoint_url="http://minio:9000",
        region_name="us-east-1",
        aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
    )
    resource.create_bucket(Bucket="frappe")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
