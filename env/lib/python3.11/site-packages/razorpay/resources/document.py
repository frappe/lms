from .base import Resource
from ..constants.url import URL


class Document(Resource):
    def __init__(self, client=None):
        super(Document, self).__init__(client)
        self.base_url = URL.V1 + URL.DOCUMENT

    def create(self, data={}, **kwargs):
        """
        Create a Document

        Returns:
           Dictionary of document   
        """
        url = self.base_url
        return self.file_url(url, data, **kwargs)

    def fetch(self, dispute_id, data={}, **kwargs):
        """
        Fetch Document

        Returns:
            Dictionary of document
        """
        return super(Document, self).fetch(dispute_id, data, **kwargs)
