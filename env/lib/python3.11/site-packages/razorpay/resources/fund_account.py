from .base import Resource
from ..constants.url import URL


class FundAccount(Resource):
    def __init__(self, client=None):
        super(FundAccount, self).__init__(client)
        self.base_url = URL.V1 + URL.FUND_ACCOUNT_URL

    def all(self, data={}, **kwargs):
        """
        Fetch all Fund Account entities

        Returns:
            Dictionary of Fund Account
        """
        return super(FundAccount, self).all(data, **kwargs)

    def create(self, data={}, **kwargs):
        """
        Create a fund account

        Args:
            data : Dictionary having keys using which order have to be created
                'customerId' :  Customer Id for the customer
                'account_type' : The bank_account to be linked to the customer ID
                'bank_account' : key value pair

        Returns:
            fund account Dict which was created
        """
        url = self.base_url
        return self.post_url(url, data, **kwargs)