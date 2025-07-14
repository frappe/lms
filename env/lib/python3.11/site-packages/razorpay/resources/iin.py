from .base import Resource
from ..constants.url import URL


class Iin(Resource):
    def __init__(self, client=None):
        super(Iin, self).__init__(client)
        self.base_url = URL.V1 + URL.IIN

    def fetch(self, token_iin, data={}, **kwargs):
        """
        fetch card properties using token iin

        Returns:
            Iin dict for given token iin
        """

        return super(Iin, self).fetch(token_iin, data, **kwargs)

    def all(self, data={}, **kwargs):
        """
        Fetch all iins supporting native otp
        Fetch all iins with business sub-type

        Returns:
            Dictionary of Iin data
        """
        url = f"{self.base_url}/list"
        return self.get_url(url, data, **kwargs)
