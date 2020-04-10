import edit_button from '../edit_button.html';

export default function (nga, admin) {
    var Webhooks = admin.getEntity('Webhooks');
    Webhooks.creationView()
        .title('<h4>Webhooks <i class="fa fa-angle-right" aria-hidden="true"></i> Create: Webhooks</h4>')
        .fields([
            nga.field('url', 'choice')
                .defaultValue('Event Type')
                .choices([
                {value: 'add_user', label: 'User Created'},
                {value: 'update_user', label: 'User Updated'},
                {value: 'add_subscription', label: 'Created Subscription'},
                {value: 'cancel_subscription', label: 'Canceled Subscription'}
            ])
                .attributes({placeholder: 'Choose from dropdown list'})
                .validation({required: true})
                .label('Event Type URL'),

            nga.field('template')
                .label('')
                .template(edit_button),
        ])
        .onSubmitSuccess(['progression', 'notification', '$state', 'entry', 'entity', function (progression, notification, $state, entry, entity) {
                // stop the progress bar
                progression.done()
                // add a notification
                //$state.go($state.get('edit'), {entity: entity.name(), id: entry._identifierValue})
                return false;
            }]);

    return Webhooks;

}