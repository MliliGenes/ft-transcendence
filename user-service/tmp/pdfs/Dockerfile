FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils fonts-dejavu-core \
    && pip install --no-cache-dir reportlab pypdf pdfplumber pillow
WORKDIR /work
