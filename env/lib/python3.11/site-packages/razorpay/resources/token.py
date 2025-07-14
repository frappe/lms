from .base import Resource
from ..constants.url import URL


class Token(Resource):
    def __init__(self, client=None):
        super(Token, self).__init__(client)
        self.base_url = URL.V1 + URL.CUSTOMER_URL

    def create(self, data={}, **kwargs):
        """
        Create token from given dict

        Returns:
            token Dict which was created
        """
        url = '{}{}'.format(URL.V1, URL.TOKEN)

        return self.post_url(url, data, **kwargs)

    def fetch(self, customer_id, token_id, data={}, **kwargs):
        """
        Fetch Token for given Id and given customer Id

        Args:
            customer_id : Customer Id for which tokens have to be fetched
            token_id    : Id for which TOken object has to be fetched

        Returns:
            Token dict for given token Id
        """
        url = "{}/{}/tokens/{}".format(self.base_url, customer_id, token_id)
        return self.get_url(url, data, **kwargs)

    def all(self, customer_id, data={}, **kwargs):
        """
        Get all tokens for given customer Id

        Args:
            customer_id : Customer Id for which tokens have to be fetched

        Returns:
            Token dicts for given cutomer Id
        """
        url = "{}/{}/tokens".format(self.base_url, customer_id)
        return self.get_url(url, data, **kwargs)

    def delete(self, customer_id, token_id, data={}, **kwargs):
        """
        Delete Given Token For a Customer

        Args:
            customer_id : Customer Id for which tokens have to be deleted
            token_id    : Id for which TOken object has to be deleted
        Returns:
            Dict for deleted token
        """
        url = "{}/{}/tokens/{}".format(self.base_url, customer_id, token_id)
        return self.delete_url(url, data, **kwargs)

    def fetchToken(self, data={}, **kwargs):
        """
        fetch Given Token For a Customer

        Returns:
            Dict for fetch token
        """
        url = '{}{}/{}'.format(URL.V1, URL.TOKEN, "fetch")
        return self.post_url(url, data, **kwargs) 

    def deleteToken(self, data={}, **kwargs):
        """
        Delete Given Token

        Returns:
            Dict for deleted token
        """
        url = '{}{}/{}'.format(URL.V1, URL.TOKEN, "delete")
        return self.post_url(url, data, **kwargs) 

    def processPaymentOnAlternatePAorPG(self, data={}, **kwargs):
        """
        Process a Payment on another PA/PG with Token Created on Razorpay

        Returns:
            
        """
        url = '{}{}/{}'.format(URL.V1, URL.TOKEN, "service_provider_tokens/token_transactional_data")
        return self.post_url(url, data, **kwargs)                
