from .base import Resource
from ..constants.url import URL


class Customer(Resource):
    def __init__(self, client=None):
        super(Customer, self).__init__(client)
        self.base_url = URL.V1 + URL.CUSTOMER_URL

    def fetch(self, customer_id, data={}, **kwargs):
        """
        Fetch Customer for given Id

        Args:
            customer_id : Id for which customer object has to be retrieved

        Returns:
            Order dict for given customer Id
        """
        return super(Customer, self).fetch(customer_id, data, **kwargs)

    def create(self, data={}, **kwargs):
        """
        Create Customer from given dict

        Returns:
            Customer Dict which was created
        """
        url = self.base_url
        return self.post_url(url, data, **kwargs)

    def edit(self, customer_id, data={}, **kwargs):
        """
        Edit Customer information from given dict

        Returns:
            Customer Dict which was edited
        """
        url = '{}/{}'.format(self.base_url, customer_id)

        return self.put_url(url, data, **kwargs)
    
    def all(self, data={}, **kwargs):
        """
        Fetch all customer

        Returns:
            Dictionary of Customers data
        """
        return super(Customer, self).all(data, **kwargs)

    def addBankAccount(self, customer_id, data={}, **kwargs):
        """
        Add Bank Account of Customer

        Returns:
            Dictionary of Customers data
        """
        url = f"{self.base_url}/{customer_id}/bank_account"
        return self.post_url(url, data, **kwargs)

    def deleteBankAccount(self, customer_id, bank_id, data={}, **kwargs):
        """
        Delete Bank Account of Customer

        Returns:
            Dictionary of Customers data
        """
        url = f"{self.base_url}/{customer_id}/bank_account/{bank_id}"
        return self.delete_url(url, data, **kwargs)

    def requestEligibilityCheck(self, data={}, **kwargs):
        """
        Eligibility Check

        Returns:
            Dictionary of eligibility data
        """
        url = f"{self.base_url}/eligibility" 
        return self.post_url(url, data, **kwargs)

    def fetchEligibility(self, eligibility_id, data={}, **kwargs):
        """
        Fetch Eligibility by id

        Returns:
            Eligibility dict for given eligibility Id
        """
        url = f"{self.base_url}/eligibility/{eligibility_id}" 
        return self.get_url(url, data, **kwargs)
