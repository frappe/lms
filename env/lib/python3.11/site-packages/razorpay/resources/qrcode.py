from .base import Resource
from ..constants.url import URL


class Qrcode(Resource):
    def __init__(self, client=None):
        super(Qrcode, self).__init__(client)
        self.base_url = URL.V1 + URL.QRCODE_URL

    def fetch(self, qrcode_id, data={}, **kwargs):
        """
        Fetch a Qr code

        Args:
            customer_id : Id for which customer object has to be retrieved

        Returns:
            Qrcode dict for given qrcode id
        """
        return super(Qrcode, self).fetch(qrcode_id, data, **kwargs)

    def create(self, data={}, **kwargs):
        """
        Create a QR Code

        Returns:
            QrCode Dict which was created
        """
        url = self.base_url
        return self.post_url(url, data, **kwargs)
    
    def all(self, data={}, **kwargs):
        """
        Fetch All Qr Code

        Returns:
            Qrcode dict
        """
        return super(Qrcode, self).all(data, **kwargs)

    def fetch_all_payments(self, qrcode_id,  data={}, **kwargs):
        """
        Fetch Payments for a QR Code

        Returns:
            Qrcode payment dict
        """
        url = "{}/{}/payments".format(self.base_url, qrcode_id)
        return self.get_url(url, data, **kwargs)   

    def close(self, qrcode_id, **kwargs):
        """
        Close a QR Code

        Returns:
            Qrcode Dict which was closed
        """
        url = '{}/{}/close'.format(self.base_url, qrcode_id)

        return self.post_url(url, {}, **kwargs)
