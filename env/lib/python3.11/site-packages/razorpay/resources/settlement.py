from .base import Resource
from ..constants.url import URL


class Settlement(Resource):
    def __init__(self, client=None):
        super(Settlement, self).__init__(client)
        self.base_url = URL.V1 + URL.SETTLEMENT_URL

    def all(self, data={}, **kwargs):
        """
        Fetch all Settlement entities

        Returns:
            Dictionary of Settlement data
        """
        return super(Settlement, self).all(data, **kwargs)

    def fetch(self, settlement_id, data={}, **kwargs):
        """
        Fetch Settlement data for given Id

        Args:
            settlement_id : Id for which settlement object has to be retrieved

        Returns:
            settlement dict for given settlement id
        """
        return super(Settlement, self).fetch(settlement_id, data, **kwargs)

    def report(self, data={}, **kwargs):
        """
        Settlement report for a month

        Returns:
            settlement dict
        """
        url = "{}/recon/{}".format(self.base_url, 'combined')
        return self.get_url(url, data, **kwargs)    

    def create_ondemand_settlement(self, data={}, **kwargs):
        """
        create Ondemand Settlemententity

        Returns:
            settlement dict which was created
        """
        url = "{}/{}".format(self.base_url,"ondemand")
        return self.post_url(url, data, **kwargs)

    def fetch_all_ondemand_settlement(self, data={}, **kwargs):
        """
        create Ondemand Settlemententity

        Returns:
            settlement dict which was created
        """
        url = "{}/{}".format(self.base_url,"ondemand")
        return self.get_url(url, data, **kwargs)

    def fetch_ondemand_settlement_id(self, settlement_id, data={}, **kwargs):
        """
        fetch Ondemand Settlement by Id 

        Returns:
            settlement dict for given settlement id
        """
        url = "{}/ondemand/{}".format(self.base_url, settlement_id)
        return self.get_url(url, data, **kwargs)
