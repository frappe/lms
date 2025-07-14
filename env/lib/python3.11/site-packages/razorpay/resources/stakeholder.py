from .base import Resource
from ..constants.url import URL


class Stakeholder(Resource):
    def __init__(self, client=None):
        super(Stakeholder, self).__init__(client)
        self.base_url = URL.V2 + URL.ACCOUNT

    def create(self, account_id, data={}, **kwargs):
        """
        Create stakeholder from given dict and account id

        Returns:
            Stakeholder Dict which was created
        """
        url = '{}/{}{}'.format(self.base_url, account_id, URL.STAKEHOLDER)

        return self.post_url(url, data, **kwargs)

    def fetch(self, account_id, stakeholder_id,  data={}, **kwargs):
        """
        Fetch stakeholder for given account & stakeholder id

        Args:
            account_id : Id for which account object has to be retrieved
            stakeholder_id : Id for which stakeholder object has to be retrieved

        Returns:
            stakeholder dict for given account_id
        """
        url = '{}/{}{}/{}'.format(self.base_url, account_id, URL.STAKEHOLDER, stakeholder_id)

        return self.get_url(url, data, **kwargs)

    def all(self, account_id, data={}, **kwargs):
        """
        Fetch all stakeholder

        Args:
            account_id : Id for which account object has to be retrieved

        Returns:
            stakeholder dict for given account_id
        """
        url = '{}/{}{}'.format(self.base_url, account_id, URL.STAKEHOLDER)

        return self.get_url(url, data, **kwargs)        

    def edit(self, account_id, stakeholder_id, data={}, **kwargs):
        """
        Edit stakeholder information from given dict

        Returns:
            Stakeholder Dict which was edited
        """
        url = '{}/{}{}/{}'.format(self.base_url, account_id, URL.STAKEHOLDER, stakeholder_id)

        return self.patch_url(url, data, **kwargs)

    def uploadStakeholderDoc(self, account_id, stakeholder_id, data={}, **kwargs):
        """
        Upload Stakeholder Documents

        Returns:
           Stakeholder Document dict which was created            
        """
        url = '{}/{}{}/{}/{}'.format(self.base_url, account_id, URL.STAKEHOLDER, stakeholder_id, "documents")

        return self.file_url(url, data, **kwargs)

    def fetchStakeholderDoc(self, account_id, stakeholder_id, data={}, **kwargs):
        """
        Fetch Stakeholder Documents

        Returns:
            Stakeholder Document dict for given account & stakeholder Id
        """
        url = '{}/{}{}/{}/{}'.format(self.base_url, account_id, URL.STAKEHOLDER, stakeholder_id, "documents")

        return self.get_url(url, data, **kwargs) 