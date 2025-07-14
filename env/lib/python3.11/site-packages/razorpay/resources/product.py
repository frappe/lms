from .base import Resource
from ..constants.url import URL


class Product(Resource):
    def __init__(self, client=None):
        super(Product, self).__init__(client)
        self.base_url = URL.V2 + URL.ACCOUNT

    def requestProductConfiguration(self, account_id, data={}, **kwargs):
        """
        Request a Product Configuration from given dict

        Returns:
            Product Configuration Dict which was created
        """
        url = '{}/{}{}'.format(self.base_url, account_id, URL.PRODUCT)

        return self.post_url(url, data, **kwargs)

    def fetch(self, account_id, product_id,  data={}, **kwargs):
        """
        Fetch product for given accound and product id

        Returns:
            account dict for given account_id
        """
        url = '{}/{}{}/{}'.format(self.base_url, account_id, URL.PRODUCT, product_id)
        return self.get_url(url, data, **kwargs)

    def edit(self, account_id, product_id, data={}, **kwargs):
        """
        Edit account information from given dict

        Returns:
            Account Dict which was edited
        """
        url = '{}/{}{}/{}'.format(self.base_url, account_id, URL.PRODUCT, product_id)
        return self.patch_url(url, data, **kwargs)

    def fetchTnc(self, product_name,  data={}, **kwargs):
        """
        Fetch Terms and Conditions for a Sub-Merchant

        Returns:
            Tnc dict for given account_id
        """
        url = '{}{}/{}{}'.format(URL.V2, URL.PRODUCT, product_name, URL.TNC )
        return self.get_url(url, data, **kwargs)